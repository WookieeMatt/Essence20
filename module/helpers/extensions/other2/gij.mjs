import {
  registerApplyDialog, registerChatButton, registerDerived, registerDialogToggles, registerPreRoll,
  registerRollSources, registerUse,
} from "../../extensions.mjs";
import { getSceneEpoch, epochFor } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import {
  FF, GIJ, HAWK, IA, T, feetBetween, findSourced, firstTarget, has, isFrom, itemsOf, num, onHook, parentOf, post,
  rollDif, sourceOf, writeItems,
} from "./shared.mjs";

/**
 * GI Joe Core Rulebook, Factions in Action and Hawk's Personnel Files: lending Upgrades (Support,
 * Tech Support, Extended Support), the Laser Designator, Yo Joe!'s Battle Cry, Delegate, Frequency
 * Interference, Explosive Engineer's Hang-Up, Big/Bigger Rigger, Gunport, two-weapon attacks,
 * Bio-Tech Armor, and the Armored Cabin / Drive-By vehicle traits.
 */
export const O2_GIJ = {
  support: GIJ('KyEof2TD2V4WTQB4'),
  techSupport: GIJ('SSLI0YINSvI554Bi'),
  extendedSupport: GIJ('1DZCpqOqYqVjFkoG'),
  laserDesignator: GIJ('AcNaNxZnyOfXv0f6'),
  yoJoe: GIJ('8pFYTMSWUsVsfLPD'),
  bioTechArmor: FF('KwLmQNCrkZ1cWM4x'),
  bigRigger: IA('XRn8pnRtJVdaxTC6'),
  biggerRigger: IA('vU2UK40cwyMPJJ83'),
  gunport: IA('yY8abFMBS4JF9VYA'),
  delegate: HAWK('DQFDOrYUZmZZxmi1'),
  explosiveEngineerHangUp: HAWK('rT04k3umqXPAlsA3'),
  frequencyInterference: HAWK('HLVof9JCEdRTt2zU'),
};

export const DESIGNATED_FLAG = 'o2Designated';
export const JAMMED_FLAG = 'o2Jammed';

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
/*  Laser Designator                             */
/* -------------------------------------------- */

/**
 * Laser Designator (GI Joe CRB p.162): "Acts as a pair of binoculars, and also grants ↑2 to
 * Targeting Skill Tests for the squad to use artillery against a target." Designating is the Use
 * button (the current target, for the scene); the ↑2 is a listed source on every Targeting roll
 * against it, which the roller unticks if it isn't artillery.
 */
export function isDesignated(target) {
  const mark = target?.flags?.essence20?.[DESIGNATED_FLAG];
  return !!mark && mark.scene == getSceneEpoch();
}

registerUse({
  id: 'o2LaserDesignator',
  matches: isFrom(O2_GIJ.laserDesignator),
  async run(item) {
    const target = firstTarget();
    if (!target) {
      ui.notifications?.warn?.(T('O2NeedTarget'));
      return null;
    }

    await target.setFlag('essence20', DESIGNATED_FLAG, { by: item.parent.name, scene: getSceneEpoch() });
    return T('O2Designated', { name: item.parent.name, target: target.name });
  },
});

registerRollSources((actor, target, ctx) => {
  const sources = [];
  if (target && target.id != actor.id && ctx?.rolledSkill == 'targeting' && isDesignated(target)) {
    sources.push({ id: 'o2LaserDesignator', label: T('O2DesignatorSource'), shiftUp: 2 });
  }

  return { sources };
});

/* -------------------------------------------- */
/*  Yo Joe! - Battle Cry                         */
/* -------------------------------------------- */

/**
 * Yo Joe! (GI Joe CRB, Faction Perk, p.72), Battle Cry: "In the first round of combat, if your
 * first action is a Move action, you may add an additional 10 feet to your Movement." Live while
 * it is round 1 and no Standard action has been spent yet this turn.
 */
export function battleCryActive(actor, combat = game?.combat) {
  if (!combat || combat.round != 1 || !has(actor, O2_GIJ.yoJoe)) {
    return false;
  }

  const combatant = combat.getCombatantsByActor?.(actor)?.[0];
  if (!combatant) {
    return false;
  }

  const ledger = combatant.flags?.essence20?.actions ?? {};
  return !num(ledger.standard);
}

registerDerived(actor => {
  const ground = actor?.system?.movement?.ground;
  if (ground && num(ground.total) > 0 && battleCryActive(actor)) {
    ground.total = num(ground.total) + 10;
  }
});

// Round and ledger changes don't touch the actor, so its derived Movement is refreshed by hand.
function refreshYoJoe(combat) {
  for (const combatant of combat?.combatants ?? []) {
    if (has(combatant.actor, O2_GIJ.yoJoe)) {
      combatant.actor.reset?.();
    }
  }
}

onHook('updateCombat', combat => refreshYoJoe(combat));
onHook('updateCombatant', combatant => {
  if (has(combatant?.actor, O2_GIJ.yoJoe)) {
    combatant.actor.reset?.();
  }
});

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
/*  Frequency Interference                       */
/* -------------------------------------------- */

/**
 * Frequency Interference (Hawk's Personnel Files, General Perk, p.174): "As a Standard action, you
 * can target a piece of enemy equipment with the Computerized trait within 100 feet. If the
 * equipment is operated by one or more creatures, you make a Contested Technology Skill Test
 * against them. If no one operates the equipment, the DIF is equal to the Availability of the
 * item. On a success, the piece of equipment stops working until someone spends a Move action to
 * reboot it." Jammed items are listed on their actor; a jammed weapon can't attack and jammed armor
 * gives no Defense until rebooted from the chat card.
 */
export function isComputerized(item) {
  const traits = item?.system?.traits ?? [];
  return Array.isArray(traits) ? traits.includes('computerized') : !!traits.computerized;
}

export function jammedIds(actor) {
  return actor?.flags?.essence20?.[JAMMED_FLAG] ?? [];
}

export function isJammed(item) {
  const ids = jammedIds(item?.parent);
  return !!item && (ids.includes(item.id) || (!!parentOf(item) && ids.includes(parentOf(item).id)));
}

/** A skill die as a Roll formula ("d8" -> "1d20 + 1d8"). */
export function contestFormula(shift) {
  if (!shift || shift == 'd20') {
    return '1d20';
  }

  if (['autoSuccess', 'criticalSuccess'].includes(shift)) {
    return '99';
  }

  if (['autoFail', 'fumble'].includes(shift)) {
    return '0';
  }

  return `1d20 + ${/^\d/.test(shift) ? shift : `1${shift}`}`;
}

function operatorOf(target) {
  if (target?.type == 'vehicle' || target?.type == 'zord') {
    for (const crew of Object.values(target.system?.actors ?? {})) {
      if (crew?.vehicleRole == 'driver') {
        return fromUuidSync?.(crew.uuid) ?? null;
      }
    }

    return null;
  }

  return target;
}

registerUse({
  id: 'o2FrequencyInterference',
  matches: isFrom(O2_GIJ.frequencyInterference),
  async run(item, economy, pay) {
    const actor = item.parent;
    const target = firstTarget();
    if (!target || target.id == actor.id) {
      ui.notifications?.warn?.(T('O2NeedTarget'));
      return null;
    }

    const distance = feetBetween(actor, target);
    if (distance != null && distance > 100) {
      ui.notifications?.warn?.(T('O2OutOfRange', { range: 100 }));
      return null;
    }

    const gear = itemsOf(target).filter(i => isComputerized(i) && !jammedIds(target).includes(i.id));
    const { chooseSelect } = await import("../../grants.mjs");
    const pickedId = await chooseSelect(item.name, T('O2JamPick', { name: target.name }), gear.map(g => ({ value: g.id, label: g.name })));
    const picked = gear.find(g => g.id == pickedId);
    if (!picked || !(await pay('standard'))) {
      return null;
    }

    const operator = operatorOf(target);
    let dif;
    if (operator) {
      const roll = await new Roll(contestFormula(operator.system?.skills?.technology?.shift)).evaluate();
      await roll.toMessage?.({ speaker: ChatMessage.getSpeaker({ actor: operator }), flavor: T('O2JamContest', { name: operator.name }) });
      dif = roll.total;
    } else {
      dif = num(CONFIG.E20?.availabilityDifficulties?.[picked.system?.availability]);
    }

    if (!(await rollDif(actor, 'technology', dif)).success) {
      return T('O2JamFailed', { name: actor.name, item: picked.name });
    }

    await target.setFlag('essence20', JAMMED_FLAG, [...jammedIds(target), picked.id]);
    await post(target, `${T('O2Jammed', { name: target.name, item: picked.name })}
      <button type="button" data-e20-ext="o2Reboot" data-actor-uuid="${target.uuid}" data-item-id="${picked.id}">${T('O2Reboot')}</button>`);
    return null;
  },
});

registerChatButton('o2Reboot', async (message, button) => {
  const target = await fromUuid(button.dataset.actorUuid);
  if (!target?.isOwner) {
    return;
  }

  if (game.combat) {
    const { spend } = await import("../../action-economy.mjs");
    const result = await spend(target, 'move', { source: T('O2Reboot') });
    if (result?.blocked) {
      return;
    }
  }

  await target.setFlag('essence20', JAMMED_FLAG, jammedIds(target).filter(id => id != button.dataset.itemId));
  await post(target, T('O2Rebooted', { name: target.name }));
});

registerPreRoll((actor, dataset, item) => {
  if (item && isJammed(item)) {
    ui.notifications?.warn?.(T('O2JammedNoRoll', { item: (parentOf(item) ?? item).name }));
    dataset.cancelRoll = true;
  }
});

registerDerived(actor => {
  const ids = jammedIds(actor);
  if (!ids.length || !actor.system?.defenses) {
    return;
  }

  for (const armor of itemsOf(actor).filter(i => i.type == 'armor' && i.system?.equipped && ids.includes(i.id))) {
    for (const [defense, field] of [['toughness', 'totalBonusToughness'], ['evasion', 'totalBonusEvasion']]) {
      const amount = num(armor.system?.[field]);
      const target = actor.system.defenses[defense];
      if (amount && target) {
        target.total = num(target.total) - amount;
        if (typeof target.string == 'string') {
          target.string += ` - ${amount} (${armor.name})`;
        }
      }
    }
  }
});

/* -------------------------------------------- */
/*  Explosive Engineer's Hang-Up                 */
/* -------------------------------------------- */

/** Grenades have no field of their own; every grenade Item is named as one. */
export function isGrenade(item) {
  return [item, parentOf(item)].some(i => /grenade/i.test(i?.name ?? ''));
}

// Explosive Engineer (Hawk's Personnel Files, Hang-Up, p.166): "Your Influence Perk does not apply
// to grenades." Clears dice.mjs's Science/Technology substitution for a grenade attack.
registerApplyDialog((actor, options, ctx) => {
  if (!has(actor, O2_GIJ.explosiveEngineerHangUp) || !isGrenade(ctx?.item)) {
    return;
  }

  if (options.applyExplosiveEngineerScience || options.applyExplosiveEngineerTechnology) {
    options.applyExplosiveEngineerScience = false;
    options.applyExplosiveEngineerTechnology = false;
    ui.notifications?.info?.(T('O2GrenadeNoEngineer'));
  }
});

/* -------------------------------------------- */
/*  Big Rigger / Bigger Rigger                   */
/* -------------------------------------------- */

export function sizeIndex(size) {
  return Object.keys(CONFIG.E20?.actorSizes ?? {}).indexOf(size);
}

/** dice.mjs#_getSizeShift: half the ladder distance, rounded down. */
export function sizeShift(attacker, target) {
  const a = sizeIndex(attacker?.system?.size);
  const t = sizeIndex(target?.system?.size);
  return a < 0 || t < 0 ? 0 : Math.floor(Math.abs(a - t) / 2);
}

function driverOf(vehicle) {
  for (const crew of Object.values(vehicle?.system?.actors ?? {})) {
    if (crew?.vehicleRole == 'driver') {
      return fromUuidSync?.(crew.uuid) ?? null;
    }
  }

  return null;
}

/**
 * Big Rigger (Intercontinental Adventures, General Perk, p.63): "When the Size Class Combat
 * Adjustment Matrix indicates that a smaller attacker gains Upshifts for targeting a vehicle you're
 * driving, these Upshifts only apply if you defend with Evasion." Bigger Rigger: "when you defend
 * with Toughness, the smaller attacking vehicle does not gain any benefits from the Size Class
 * Combat Adjustment Matrix." Cancelled against the Defense the attack names.
 */
export function riggerCancel(attacker, vehicle, defense) {
  if (!['vehicle', 'zord'].includes(vehicle?.type) || sizeIndex(attacker?.system?.size) >= sizeIndex(vehicle.system?.size)) {
    return null;
  }

  const driver = driverOf(vehicle);
  const shift = sizeShift(attacker, vehicle);
  if (!driver || !shift) {
    return null;
  }

  if (has(driver, O2_GIJ.bigRigger) && defense != 'evasion') {
    return { perk: findSourced(driver, O2_GIJ.bigRigger), shift };
  }

  if (has(driver, O2_GIJ.biggerRigger) && defense == 'toughness' && ['vehicle', 'zord'].includes(attacker?.type)) {
    return { perk: findSourced(driver, O2_GIJ.biggerRigger), shift };
  }

  return null;
}

registerRollSources((actor, target, ctx) => {
  const sources = [];
  if (target && ctx?.isAttack) {
    const defense = ctx.dataset?.defenseType ?? ctx.item?.system?.defenseType;
    const cancel = riggerCancel(actor, target, defense);
    if (cancel) {
      sources.push({ id: 'o2Rigger', label: cancel.perk?.name ?? 'Big Rigger', shiftDown: cancel.shift });
    }
  }

  // Gunport (Intercontinental Adventures p.93): "You can fire a sidearm ranged weapon while using
  // the active effect of this shield with a ↓1."
  const weapon = parentOf(ctx?.item);
  if (ctx?.isAttack && !ctx.isMelee && weapon?.system?.classification?.size == 'sidearm' && firingThroughGunport(actor)) {
    sources.push({ id: 'o2Gunport', label: findSourced(actor, O2_GIJ.gunport)?.name ?? 'Gunport', shiftDown: 1 });
  }

  return { sources };
});

export function firingThroughGunport(actor) {
  return itemsOf(actor).some(item => {
    if (item.type != 'upgrade' || sourceOf(item) != O2_GIJ.gunport) {
      return false;
    }

    const holder = parentOf(item);
    if (!holder?.system?.equipped) {
      return false;
    }

    return holder.type == 'shield' ? !!holder.system.active : (holder.system?.traits ?? []).includes?.('shield');
  });
}

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
/*  Bio-Tech Armor                               */
/* -------------------------------------------- */

/**
 * Bio-Tech Armor (Ferocious Fighters, Mega Marines, p.74): "You can wear two sets of battledress,
 * as long as one set has the Organic Battledress Upgrade and the other has the Computerized trait."
 * Equipping a second set warns unless this pair qualifies.
 */
export function bioTechPair(a, b) {
  const organic = armor => itemsOf(armor?.parent).some(i => i.type == 'upgrade' && i.flags?.essence20?.parentId == armor.id && /organic/i.test(i.name ?? ''));
  return (organic(a) && isComputerized(b)) || (organic(b) && isComputerized(a));
}

onHook('preUpdateItem', (item, changes) => {
  if (item?.type != 'armor' || !foundry.utils.getProperty(changes, 'system.equipped') || item.system?.equipped) {
    return;
  }

  const other = itemsOf(item.parent).find(i => i.type == 'armor' && i.id != item.id && i.system?.equipped && !i.system?.isPowerArmor);
  if (!other || item.system?.isPowerArmor) {
    return;
  }

  if (has(item.parent, O2_GIJ.bioTechArmor) && bioTechPair(item, other)) {
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

