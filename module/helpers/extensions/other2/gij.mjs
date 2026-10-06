import {
  registerApplyDialog, registerDialogToggles, registerPreRoll, registerUse,
} from "../../extensions.mjs";
import { getSceneEpoch, epochFor } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import {
  GIJ, HAWK, T, feetBetween, firstTarget, has, isFrom, itemsOf, num, onHook, parentOf,
  sourceOf, writeItems,
} from "./shared.mjs";
import { ruleAllowsArmorPair } from "../../../rules/ext/b/veto.mjs";

/**
 * GI Joe Core Rulebook, Factions in Action and Hawk's Personnel Files: lending Upgrades (Support,
 * Tech Support, Extended Support), Delegate, two-weapon attacks, Bio-Tech Armor, and the Armored Cabin / Drive-By
 * vehicle traits. (The Laser Designator and Explosive Engineer's Hang-Up are item rules - rules/conv10-slC10.test.js;
 * Frequency Interference too - rules/conv10-slD10.test.js.)
 */
export const O2_GIJ = {
  support: GIJ('KyEof2TD2V4WTQB4'),
  techSupport: GIJ('SSLI0YINSvI554Bi'),
  extendedSupport: GIJ('1DZCpqOqYqVjFkoG'),
  delegate: HAWK('DQFDOrYUZmZZxmi1'),
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
 * The ally gets a temporary copy of the Upgrade (helpers/weapon-perk-uses.mjs sweeps it when its
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

  const { chooseButtons, chooseSelect } = await import("../../grants.mjs");
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
    const { setEntryAndAddItem } = await import("../../../sheet-handlers/attachment-handler.mjs");
    const key = await setEntryAndAddItem(created, ally.items.get(weaponId));
    if (key) {
      await created.setFlag('essence20', 'collectionId', key);
    }
  }

  return T(scene ? 'O2LentScene' : 'O2LentTurn', { name: actor.name, ally: ally.name, upgrade: upgrade.name });
}

registerUse({ id: 'o2Support', matches: item => [O2_GIJ.support, O2_GIJ.techSupport].includes(sourceOf(item)), run: lendUpgrade });

/* -------------------------------------------- */
/*  Delegate                                     */
/* -------------------------------------------- */

/**
 * Delegate (Hawk's Personnel Files, Old Hand, 6th level, p.165): "you can use one of your Moxie
 * Points to allow an ally within sight one additional use of one of their Role Perks or General
 * Perks." A use is a counted record on the ally (helpers/scene-clock.mjs's {epoch, count}, or a
 * this-turn/this-round stamp from helpers/perks.mjs) - the pick hands one of them back.
 */
export function refundableUses(ally, combat = game?.combat) {
  const rows = [];
  for (const [key, record] of Object.entries(ally?.flags?.essence20 ?? {})) {
    if (!record || typeof record != 'object') {
      continue;
    }

    if (record.window && typeof record.count == 'number' && record.count > 0 && record.epoch === epochFor(record.window)) {
      rows.push({ key, kind: 'count', record });
    } else if (record.combatId && combat && record.combatId == combat.id && record.round == combat.round
      && (record.turn === undefined || record.turn == combat.turn) && Object.keys(record).length <= 3) {
      rows.push({ key, kind: 'stamp', record });
    }
  }

  return rows;
}

export const labelOf = key => key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();

registerUse({
  id: 'o2Delegate',
  matches: isFrom(O2_GIJ.delegate),
  async run(item) {
    const actor = item.parent;
    const ally = firstTarget();
    if (!ally || ally.id == actor.id) {
      ui.notifications?.warn?.(T('O2NeedAlly'));
      return null;
    }

    const { findRolePointsItem } = await import("../../reroll.mjs");
    const moxie = findRolePointsItem(actor, 'Moxie');
    if (!moxie || (!actor.system?.useUnlimitedResource && num(moxie.system?.resource?.value) < 1)) {
      ui.notifications?.warn?.(T('O2NoMoxie'));
      return null;
    }

    const rows = refundableUses(ally);
    if (!rows.length) {
      ui.notifications?.warn?.(T('O2DelegateNothing', { name: ally.name }));
      return null;
    }

    const { chooseSelect } = await import("../../grants.mjs");
    const key = await chooseSelect(item.name, T('O2DelegatePick', { name: ally.name }), rows.map(r => ({ value: r.key, label: labelOf(r.key) })));
    const row = rows.find(r => r.key == key);
    if (!row) {
      return null;
    }

    if (row.kind == 'count' && row.record.count > 1) {
      await ally.setFlag('essence20', row.key, { ...row.record, count: row.record.count - 1 });
    } else {
      await ally.unsetFlag('essence20', row.key);
    }

    if (!actor.system?.useUnlimitedResource) {
      await moxie.update({ 'system.resource.value': num(moxie.system.resource.value) - 1 });
    }

    return T('O2Delegated', { name: actor.name, ally: ally.name, use: labelOf(row.key) });
  },
});

/* -------------------------------------------- */
/*  Two light weapons                            */
/* -------------------------------------------- */

/**
 * Attacking with two light weapons: "the usual ↓1 on one Attack and ↓2 on the other" (Intercontinental
 * Adventures p.12-13, Two-Handed Assault) - dice.mjs's Two-Handed Assault checkbox gives its ↑1 on
 * top of this.
 */
export function isLightWeaponAttack(item) {
  return item?.type == 'weaponEffect' && ['light', 'sidearm'].includes(parentOf(item)?.system?.classification?.size);
}

registerDialogToggles((actor, ctx) => (isLightWeaponAttack(ctx?.item) ? [{
  name: 'o2TwoWeapons', label: T('O2TwoWeapons'), type: 'select', value: 'none',
  options: [
    { value: 'none', label: T('O2TwoWeaponsNone') },
    { value: 'first', label: T('O2TwoWeaponsFirst') },
    { value: 'second', label: T('O2TwoWeaponsSecond') },
  ],
}] : []));

registerApplyDialog((actor, options) => {
  const pick = options.ext?.o2TwoWeapons;
  if (pick == 'first') {
    options.shiftDown = num(options.shiftDown) + 1;
  } else if (pick == 'second') {
    options.shiftDown = num(options.shiftDown) + 2;
  }
});

/* -------------------------------------------- */
/*  Two sets of armor                            */
/* -------------------------------------------- */

/**
 * Equipping a second set of armor warns, unless the wearer's ArmorPair rules allow that pair (Bio-Tech Armor - an
 * Organic Battledress set with a Computerized one: rules/ext/b/veto.mjs).
 */

onHook('preUpdateItem', (item, changes) => {
  if (item?.type != 'armor' || !foundry.utils.getProperty(changes, 'system.equipped') || item.system?.equipped) {
    return;
  }

  const other = itemsOf(item.parent).find(i => i.type == 'armor' && i.id != item.id && i.system?.equipped && !i.system?.isPowerArmor);
  if (!other || item.system?.isPowerArmor) {
    return;
  }

  if (ruleAllowsArmorPair(item.parent, item, other)) {
    return;
  }

  ui.notifications?.warn?.(T('O2TwoArmors', { name: item.parent?.name ?? '' }));
});

/* -------------------------------------------- */
/*  Armored Cabin / Drive-By                     */
/* -------------------------------------------- */

/** The vehicle this actor rides in, if any. */
export function vehicleOf(actor) {
  if (!actor?.uuid) {
    return null;
  }

  return worldActors().find(v => ['vehicle', 'zord'].includes(v.type)
    && Object.values(v.system?.actors ?? {}).some(crew => crew?.uuid == actor.uuid)) ?? null;
}

/** Feet this token has moved on the current turn (Foundry's movement history). */
export function feetMovedThisTurn(actor) {
  const token = actor?.getActiveTokens?.()?.[0]?.document;
  const history = token?.movementHistory;
  if (!Array.isArray(history) || !globalThis.canvas?.grid?.measurePath) {
    return null;
  }

  let feet = 0;
  for (let i = 1; i < history.length; i++) {
    feet += canvas.grid.measurePath([history[i - 1], history[i]]).distance;
  }

  return feet;
}

registerPreRoll((actor, dataset, item) => {
  if (item?.type != 'weaponEffect' || dataset.cancelRoll) {
    return;
  }

  // Armored Cabin (GI Joe CRB p.172): "Attacks can't target the vehicle's Crew."
  for (const target of [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean)) {
    const vehicle = vehicleOf(target);
    if (vehicle?.system?.traits?.armoredCabin && vehicle.id != actor.id) {
      ui.notifications?.warn?.(T('O2ArmoredCabin', { name: target.name, vehicle: vehicle.name }));
      dataset.cancelRoll = true;
      return;
    }
  }

  // Drive-By (GI Joe CRB p.172) is extensions/data1/weapon-rules.mjs's: it asks before a Ram or
  // Flyby attack with less than 15ft moved.
});

