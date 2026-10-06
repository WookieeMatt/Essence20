import { registerUse } from "../../mechanics/item-hooks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { GIJ, writeItems } from "../shared/gm-relayed-item-writes.mjs";
import { T } from "../shared/item-lang.mjs";
import { feetBetween, firstTargetedActor as firstTarget } from "../shared/sides.mjs";
import { has, itemsOf, sourceOf } from "../shared/item-lookups.mjs";

/**
 * GI Joe Core Rulebook: lending Upgrades (Support, Tech Support, Extended Support). (Delegate, two-weapon attacks,
 * Bio-Tech Armor and the Armored Cabin / Drive-By vehicle traits are items/social/delegate.mjs,
 * items/attacks/two-light-weapons.mjs, items/defenses/two-armor-sets-warning.mjs and items/vehicles/armored-cabin.mjs.
 * The Laser Designator and Explosive Engineer's Hang-Up are item rules - rules/conv10-slC10.test.js; Frequency
 * Interference too - rules/conv10-slD10.test.js.)
 */
export const O2_GIJ = {
  support: GIJ('KyEof2TD2V4WTQB4'),
  techSupport: GIJ('SSLI0YINSvI554Bi'),
  extendedSupport: GIJ('1DZCpqOqYqVjFkoG'),
};

/* -------------------------------------------- */
/*  Support / Tech Support / Extended Support    */
/* -------------------------------------------- */

/**
 * Support (GI Joe CRB, Technician, 2nd level, p.103): "you can grant an adjacent ally the benefits
 * of one of your Upgrades as a Free action. These benefits last until the start of your next turn."
 * Tech Support (9th level): "an ally within range of your Primary Tech". Extended Support (14th
 * level, p.104): "you can choose to use Support or Tech Support as a Move action instead of a Free
 * action. In that case, the benefits last for the duration of the scene."
 *
 * The ally gets a temporary copy of the Upgrade (items/attacks/weapon-perk-uses.mjs sweeps it when its
 * time is up): an armor Upgrade counts loose, a weapon Upgrade goes on the weapon they pick.
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

export function lendableUpgrades(actor) {
  return itemsOf(actor).filter(item => item.type == 'upgrade' && !item.flags?.essence20?.temporary && !item.flags?.essence20?.o2LentFrom);
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

async function lendUpgrade(item, economy, pay) {
  const actor = item.parent;
  const ally = firstTarget();
  if (!ally || ally.id == actor.id) {
    ui.notifications?.warn?.(T('O2NeedAlly'));
    return null;
  }

  const isTech = sourceOf(item) == O2_GIJ.techSupport;
  const distance = feetBetween(actor, ally);
  if (!isTech && distance != null && distance > 5) {
    ui.notifications?.warn?.(T('O2NeedAdjacent'));
    return null;
  }

  const { chooseButtons, chooseSelect } = await import("../../mechanics/resources/grants.mjs");
  const upgrades = lendableUpgrades(actor);
  const upgradeId = await chooseSelect(item.name, T('O2LendPick'), upgrades.map(u => ({ value: u.id, label: u.name })));
  const upgrade = upgrades.find(u => u.id == upgradeId);
  if (!upgrade) {
    return null;
  }

  let scene = false;
  if (has(actor, O2_GIJ.extendedSupport)) {
    const how = await chooseButtons(item.name, T('O2LendHow'), [['free', T('O2LendFree')], ['move', T('O2LendMove')]]);
    if (!how) {
      return null;
    }

    scene = how == 'move';
  }

  let weaponId = null;
  if (upgrade.system?.type == 'weapon') {
    const weapons = itemsOf(ally).filter(i => i.type == 'weapon');
    weaponId = await chooseSelect(item.name, T('O2LendWeapon', { name: ally.name }), weapons.map(w => ({ value: w.id, label: w.name })));
    if (!weaponId) {
      return null;
    }
  }

  if (!(await pay(scene ? 'move' : 'free'))) {
    return null;
  }

  const [created] = await writeItems(ally, { create: [lentCopy(upgrade, lendStamp(scene), actor, weaponId)] }) ?? [];
  if (created && weaponId && ally.isOwner) {
    const { setEntryAndAddItem } = await import("../../sheet-handlers/attachment-handler.mjs");
    const key = await setEntryAndAddItem(created, ally.items.get(weaponId));
    if (key) {
      await created.setFlag('essence20', 'collectionId', key);
    }
  }

  return T(scene ? 'O2LentScene' : 'O2LentTurn', { name: actor.name, ally: ally.name, upgrade: upgrade.name });
}

registerUse({ id: 'o2Support', matches: item => [O2_GIJ.support, O2_GIJ.techSupport].includes(sourceOf(item)), run: lendUpgrade });
