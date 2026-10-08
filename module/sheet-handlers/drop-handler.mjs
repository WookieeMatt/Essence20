import { checkIsLocked } from "../util/sheet-lock.mjs";
import { createId, parseId } from "../util/utils.mjs";
import { onAlterationDrop } from "./alteration-handler.mjs";
import { _attachItem, onAttachmentDrop, onAttachableParentDrop, onEquipmentPackageDrop } from "./attachment-handler.mjs";
import { onInfluenceDrop, onOriginDrop } from "./background-handler.mjs";
import { onPowerDrop } from "./power-handler.mjs";
import { setPerkValues } from "./perk-handler.mjs";
import { onFocusDrop, onRoleDrop } from "./role-handler.mjs";
import { onFactionDrop } from "./faction-handler.mjs";
import { onZordFeatureDrop } from "./zord-feature-handler.mjs";
import { getCombineReadyRound, isCombineReady, rollCombineTimer } from "../mechanics/vehicles/combiner-timer.mjs";
import { canBeParticipant, getMegaformParticipants, isGuestComponent } from "../mechanics/vehicles/megaform-participants.mjs";
import VehicleRoleSelector from "../apps/vehicle-role-selector.mjs";
import { DETACHED_THIS_SCENE_FLAG } from "./vehicle-handler.mjs";
import { hasUsedThisEncounter } from "../mechanics/characters/perks.mjs";
import { clearWarriorMode } from "../items/zords/warrior-mode.mjs";
import { confirmGmDrop } from "../rules/prerequisites.mjs";

/**
 * Handle dropping an Item onto an Actor.
 * @param {Object} data The data transfer extracted from the event
 * @param {Actor} actor The Actor receiving the Item
 * @param {Function} dropFunc The function to call to complete the Item drop
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 */
export async function onDropItem(data, actor, dropFunc) {
  if (checkIsLocked(actor)) {
    return false;
  }

  const sourceItem = await fromUuid(data.uuid);
  if (!sourceItem) return false;

  // Don't drop a new item if they're just sorting
  if (actor.uuid === sourceItem?.parent?.uuid) {
    return await _onDropDefault(data, dropFunc, false);
  }

  // Strict prerequisites: a GM is asked before adding an item the character doesn't qualify for.
  if (!(await confirmGmDrop(actor, sourceItem))) {
    return false;
  }

  let result = null;

  switch (sourceItem.type) {
  case 'alteration':
    result = await onAlterationDrop(actor, sourceItem, dropFunc);
    break;
  case 'armor':
    result = await onAttachableParentDrop(actor, sourceItem, dropFunc);
    break;
  // An Alt Mode dropped straight on (a Mini-Con, a Monstrosity form) makes the character able to transform, as one
  // that comes with an Origin does (background-handler.mjs) - play-through 2026-10-07: the button never showed.
  case 'altMode':
    result = await dropFunc();
    if (result && !actor.system.canTransform && 'canTransform' in (actor.system ?? {})) {
      await actor.update({ 'system.canTransform': true });
    }

    break;
  case 'equipmentPackage':
    result = await onEquipmentPackageDrop(actor, sourceItem);
    break;
  case 'faction':
    result = await onFactionDrop(actor, dropFunc);
    break;
  case 'feature':
    result = await onZordFeatureDrop(actor, sourceItem, dropFunc);
    break;
  case 'focus':
    result = await onFocusDrop(actor, sourceItem, dropFunc);
    break;
  case 'influence':
    result = await onInfluenceDrop(actor, sourceItem, dropFunc);
    break;
  // A Megaform Trait is contributed BY a component - the Zords of a Megazord, or the Transformers
  // of a Combiner - and the Megaform aggregates whatever its current participants hold (see
  // Essence20Actor#_prepareMegaformZordData/_prepareMegaformCombinerData). A Megaform holds none
  // of its own, so dropping one straight onto it used to be accepted silently: the item sat on the
  // sheet looking applied while contributing nothing, and quietly vanished from the Megaform's
  // stats the moment you looked for its effect. Refused outright instead, naming where it goes.
  case 'megaformTrait':
    if (actor.type == 'megaform') {
      ui.notifications.error(game.i18n.localize('E20.MegaformTraitMegaformDropError'));
      break;
    }

    // Detachable "cannot be chosen if the Zord also has the Core Body Megaform Trait" (Across the Stars p.104) - either
    // way round.
    if (clashingMegaformTrait(actor, sourceItem)) {
      ui.notifications.error(game.i18n.localize('E20.DetachableCoreBodyClash'));
      break;
    }

    result = await dropFunc();
    break;
  case 'origin':
    result = await onOriginDrop(actor, sourceItem, dropFunc);
    break;
  case 'perk':
    result = await setPerkValues(actor, sourceItem, null, dropFunc);
    break;
  case 'power':
    result = await onPowerDrop(actor, sourceItem, dropFunc);
    break;
  case 'role':
    result = await onRoleDrop(actor, sourceItem, dropFunc);
    break;
  case 'rolePoints':
    ui.notifications.error(game.i18n.localize('E20.RolePointsActorDropError'));
    break;
  case 'shield' :
    result = await onAttachableParentDrop(actor, sourceItem, dropFunc);
    break;
  case 'upgrade':
    result = await _onUpgradeDrop(sourceItem, actor, dropFunc);
    break;
  case 'weapon': {
    const before = new Set(actor.items.map(item => item.id));
    result = await onAttachableParentDrop(actor, sourceItem, dropFunc);
    // A Gigantic or larger wielder: offer the weapon made for its size (EoC p.47, Table 3-1).
    const added = actor.items.find(item => item.type == 'weapon' && !before.has(item.id));
    if (added) {
      const { offerUpscale } = await import("../items/attacks/weapon-upscale.mjs");
      await offerUpscale(actor, added);
    }

    break;
  }

  case 'weaponEffect':
    result = onAttachmentDrop(actor, sourceItem, dropFunc);
    break;

  default:
    result = await dropFunc();
  }

  if (result) {
    ui.notifications.info(
      game.i18n.format(
        'E20.ItemDropSuccess',
        {itemName: sourceItem.name, actorName: actor.name},
      ),
    );
  }
}

/**
 * Handle dropping of any other item an Actor sheet
 * @param {Object} data The data transfer extracted from the event
 * @param {Function} dropFunc The function to call to complete the Item drop
 * @param {Boolean} isNewItem Whether a new Item is intended to be dropped
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 */
async function _onDropDefault(data, dropFunc, isNewItem=true) {
  const itemUuid = await parseId(data.uuid);
  let droppedItemList = await dropFunc();

  if (isNewItem) {
    const newItem = droppedItemList[0];
    await newItem.update ({
      "system.originalId": itemUuid,
    });
  } else {
    droppedItemList = [];
  }

  return droppedItemList;
}

/**
 * An armor Upgrade dropped on an actor that can transform. A Cybertronian installs Armor Upgrades
 * in its own body (a loose Upgrade with no parentId, counted by actor.mjs#_prepareDefenses in
 * either mode) - but if the actor also has Armor, ask whether it goes in the body or onto that
 * Armor instead, rather than always picking the body.
 * @param {Upgrade} upgrade The armor Upgrade being dropped
 * @param {Actor} actor The transforming Actor receiving it
 * @param {Function} dropFunc The function to call to complete the drop
 * @returns {Promise<object|boolean>} The drop result, or false if the prompt was dismissed.
 */
export async function _onTransformerArmorUpgradeDrop(upgrade, actor, dropFunc) {
  // Power Armor is the Ranger's Morphed form, not something an Upgrade bolts onto.
  const armors = (actor.items.documentsByType?.armor ?? []).filter(armor => !armor.system.isPowerArmor);
  if (!armors.length) {
    return dropFunc();
  }

  const buttons = [{ label: game.i18n.localize('E20.ArmorUpgradeInstallBody'), action: 'body', default: true }];
  for (const armor of armors) {
    const label = armor.system.equipped
      ? game.i18n.format('E20.ArmorUpgradeInstallOnArmorEquipped', { name: armor.name })
      : game.i18n.format('E20.ArmorUpgradeInstallOnArmor', { name: armor.name });
    buttons.push({ label, action: armor.id });
  }

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ArmorUpgradeInstallTitle') },
    classes: ["window-app", "e20-window"],
    content: `<p>${game.i18n.format('E20.ArmorUpgradeInstallContent', { upgrade: upgrade.name, name: actor.name })}</p>`,
    buttons,
    rejectClose: false,
  });

  if (!choice) {
    return false;
  } else if (choice == 'body') {
    return dropFunc();
  }

  const armor = armors.find(a => a.id == choice);
  return armor ? _attachItem(actor, armor, dropFunc) : false;
}

/**
 * Handle dropping of an Upgrade onto an Actor sheet
 * @param {Upgrade} upgrade The Upgrade being dropped
 * @param {Actor} actor The Actor receiving the Upgrade
 * @param {Function} dropFunc The function to call to complete the Upgrade drop
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 */
export async function _onUpgradeDrop(upgrade, actor, dropFunc) {
  // Drones can only accept drone Upgrades
  if (actor.type == 'companion' && actor.system.type == 'drone' && upgrade.system.type == 'drone') {
    return dropFunc();
  } else if (actor.type == 'vehicle' && upgrade.system.type == 'drone' && ['ridingRig', 'jetPack'].includes(actor.flags?.essence20?.personalVehicle)) {
    // Riding Rig / Skybound (Cobra Codex p.60, 65): Drone Upgrades can be requisitioned for it when it
    // meets their other prerequisites.
    return dropFunc();
  } else if (actor.system.canTransform && upgrade.system.type == 'armor') {
    return _onTransformerArmorUpgradeDrop(upgrade, actor, dropFunc);
  } else if (['armor', 'weapon'].includes(upgrade.system.type)) {
    return onAttachmentDrop(actor, upgrade, dropFunc);
  } else if (actor.type == 'vehicle' && upgrade.system.type == 'vehicle') {
    // A Vehicle-type Upgrade (e.g. Heavy Water Coolant, Operation Cold Iron p.49) attaches
    // directly to the Vehicle actor itself, not to a sub-item on its sheet the way an
    // armor/weapon Upgrade attaches to a piece of gear - embedded plainly, same as a Perk.
    // Energy Resistant, Energized Plating, Double-Barrel and Targeting System then ask their
    // choice (a pick step in their 'added' Trigger rules).
    return dropFunc();
  } else {
    ui.notifications.error(game.i18n.localize('E20.UpgradeDropError'));
    return false;
  }
}

/**
 * Handle dropping of an Actor data onto another Actor sheet
 * @param {Object} data The data transfer extracted from the event
 * @param {ActorSheet} actorSheet The ActorSheet who is being dropped on to
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 */
export async function onDropActor(data, actorSheet) {
  const targetActor = actorSheet.actor;
  if (!targetActor.isOwner) return false;

  // Get the target actor
  const droppedActor = await fromUuid(data.uuid);
  if (!droppedActor) return false;

  let dropIsValid = false;
  switch (targetActor.type) {
  case 'playerCharacter':
    if (droppedActor.type =='zord' && targetActor.system.canHaveZord || droppedActor.type == 'npc') {
      // Only a Contact can be added: an NPC that isn't one yet is offered the switch, or refused.
      const { offerMakeContact } = await import("../mechanics/companions/contacts.mjs");
      if (!(await offerMakeContact(droppedActor))) {
        return false;
      }

      await setEntryAndAddActor(droppedActor, targetActor);
      dropIsValid = true;

      // A Zord newly linked to its Ranger: its starting Spectrum and team Zord Features (PR CRB p.134) -
      // mechanics/vehicles/zord-auto-features.mjs.
      if (droppedActor.type == 'zord') {
        const { offerAutoFeatures } = await import("../mechanics/vehicles/zord-auto-features.mjs");
        await offerAutoFeatures(targetActor, droppedActor);
      }
    } else if (['companion', 'vehicle'].includes(droppedActor.type)) {
      // A pet, drone, Mini-Con or companion - or a personal vehicle - becomes this character's
      // (mechanics/companions/companion-link.mjs).
      const { linkCompanion } = await import("../mechanics/companions/companion-link.mjs");
      await linkCompanion(targetActor, droppedActor);
      dropIsValid = true;
    }

    break;
  case 'megaform':
    // Detachable (Across the Stars, p.104): "may not reattach in the same scene" - see
    // vehicle-handler.mjs's own DETACHED_THIS_SCENE_FLAG comment for where this gets set.
    if (droppedActor.type == 'zord' && hasUsedThisEncounter(droppedActor, DETACHED_THIS_SCENE_FLAG)) {
      ui.notifications.error(game.i18n.format('E20.DetachableCannotReattach', { name: droppedActor.name }));
      return;
    }

    // Who can join this kind of Megaform (mechanics/vehicles/megaform-participants.mjs): a Megazord takes Zords and
    // Cybertronians (Field Guide p.134); a Combiner takes characters, and a Zord joining Cybertronians makes a Megazord
    // instead. Anything that would be linked but never count is refused with the reason.
    if (!canBeParticipant(targetActor, droppedActor)) {
      const combiner = targetActor.system.subtype?.includes?.('megaformCombiner');
      ui.notifications.warn(game.i18n.format(
        combiner && droppedActor.type == 'zord' ? 'E20.MegaformZordInCombiner' : combiner ? 'E20.MegaformCombinerRefuses' : 'E20.MegaformMegazordRefuses',
        { name: droppedActor.name },
      ));
      return false;
    }

    // A Transformers Combiner: Mode Lock stops merging (EoC p.49), and a PC with no Combiner Perk joins as an Other
    // Cybertronian - a Story Point, the Energon and a Standard action, for this scene (EoC p.43).
    if (targetActor.system.subtype?.includes?.('megaformCombiner')) {
      const { beginGuestMerge, holdsMergePerk, modeLocked } = await import("../items/zords/combiner-merge.mjs");
      if (modeLocked(droppedActor)) {
        return false;
      }

      if (droppedActor.type == 'playerCharacter' && !holdsMergePerk(droppedActor)) {
        const line = await beginGuestMerge(droppedActor, targetActor);
        if (line) {
          ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: droppedActor }), content: line });
        }

        return false;
      }
    }

    // A Zord combines through the Combiner Zord Feature (PR CRB p.139), or a Versatile Combiner / Adaptable Future Tech
    // partner already in the Megazord (Through the Shattered Grid p.35, p.117) - refused at the drop, not warned after.
    if (droppedActor.type == 'zord' && !targetActor.system.subtype?.includes?.('megaformCombiner')) {
      const { ineligibleZords } = await import("../items/zords/zord-feature-picks.mjs");
      const present = getMegaformParticipants(targetActor).filter(actor => actor.type == 'zord');
      if (ineligibleZords([...present, droppedActor]).includes(droppedActor)) {
        ui.notifications.warn(game.i18n.format('E20.Zord2NeedsCombinerFeature', { name: droppedActor.name }));
        return false;
      }
    }

    // A Warzord combining (Across the Stars p.105): its Ranger spends 1 Story Point per Zord combining with it.
    if (!(await payWarzordStoryPoints(targetActor, droppedActor))) {
      return false;
    }

    await setEntryAndAddActor(droppedActor, targetActor);
    dropIsValid = true;

    // A Cybertronian joining Zords (Field Guide p.134): 1 Story Point (unless its own assets say otherwise), plus Energon
    // and/or Personal Power equal to the number of components - a reminder, the table spends it.
    if (isGuestComponent(targetActor, droppedActor)) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: targetActor }),
        content: game.i18n.format('E20.MegaformGuestCost', {
          name: droppedActor.name, form: targetActor.name, count: getMegaformParticipants(targetActor).length,
        }),
      });
    }

    // Warrior Mode (PR CRB, Zord Feature, p.140): "...lasts until...the Zord is involved in a
    // Combiner Megaform." This IS that moment - see items/zords/warrior-mode.mjs's own doc comment.
    if (droppedActor.type == 'zord') {
      await clearWarriorMode(droppedActor);
    }

    // Combiner join timer (PR CRB p.139) - the new participant rolls its own time (the highest sets the round), and
    // only then is it checked. Advisory: this warns rather than refusing the link, see
    // mechanics/vehicles/combiner-timer.mjs's own doc comment for why. A Transformers Combiner has no timer.
    await rollCombineTimer(targetActor);
    if (!isCombineReady(targetActor)) {
      ui.notifications.warn(game.i18n.format('E20.CombinerTimerNotReady', {
        round: getCombineReadyRound(targetActor),
      }));
    }

    break;
  case 'party':
    if (droppedActor.type == 'playerCharacter') {
      targetActor.addMember(droppedActor);
      dropIsValid = true;
    }

    break;
  case 'vehicle':
    if (["playerCharacter", "npc"].includes(droppedActor.type)) {
      _selectVehicleLocation(droppedActor, targetActor);
      dropIsValid = true;
    }

    break;
  case 'zord':
    if (["playerCharacter", "npc"].includes(droppedActor.type)) {
      _selectVehicleLocation(droppedActor, targetActor);
      dropIsValid = true;
    } else if (droppedActor.type == 'zord') {
      // Carrier (PR CRB, Zord Feature, p.136): carries up to five Vehicular-Scale Zords and their
      // Crew (mechanics/actions/team-actions.mjs).
      const { carrierCapacityLeft, TEAM } = await import("../mechanics/actions/team-actions.mjs");
      const isCarrier = targetActor.items?.some?.(item => (item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource) == TEAM.carrier);
      if (isCarrier && carrierCapacityLeft(targetActor) > 0) {
        await setEntryAndAddActor(droppedActor, targetActor, 'passenger');
        dropIsValid = true;
      }
    }

    break;
  }

  if (!dropIsValid) {
    ui.notifications.error(game.i18n.localize('E20.ActorDropError'));
  }
}

/**
 * Function to select where the actor is being seated
 * @param {Actor} droppedActor The actor that is being dropped
 * @param {Actor} targetActor The actor that is being dropped on to
 */
async function _selectVehicleLocation(droppedActor, targetActor) {
  const choices = {};

  for (const [key, name] of Object.entries(CONFIG.E20.vehicleRoles)) {
    choices[key] = {
      label: name,
      value: key,
    };
  }

  const title = "E20.VehicleRoleSelect";
  new VehicleRoleSelector(droppedActor, targetActor, choices, title).render(true);
}

/**
 *
 * @param {Actor} targetActor Actor that is being dropped on to
 * @param {String} newRole The Vehicle role that was selected
 * @returns {boolean} allowDrop
 */
export function verifyDropSelection(targetActor, newRole){
  let numberOfType = 0;
  let allowDrop = false;
  for (const [,passenger] of Object.entries(targetActor.system.actors)) {
    if (passenger.vehicleRole == newRole) {
      numberOfType++;
    }
  }

  if (newRole == 'driver') {
    if (numberOfType < targetActor.system.crew.numDrivers) {
      allowDrop = true;
    }
  } else {
    if (numberOfType < targetActor.system.crew.numPassengers) {
      allowDrop = true;
    }
  }

  return allowDrop;
}

/**
 * Sets the entry value that will be stored in system.actors
 * @param {Actor} droppedActor Actor dropped on to another actor
 * @param {Actor} targetActor Actor that is being dropped on to
 * @param {String} newRole The Vehicle role the dropped actor is being assigned
 * @returns the key generated on the drop
 */
export async function setEntryAndAddActor(droppedActor, targetActor, newRole) {
  const entry = {
    uuid: droppedActor.uuid,
    img: droppedActor.img,
    name: droppedActor.name,
    type: droppedActor.type,
  };

  if (["vehicle", "zord"].includes(targetActor.type)) {
    entry['vehicleRole'] = newRole;
  }

  return addActorIfUnique(droppedActor, targetActor, entry);
}

/**
 * Adds the dropped actor into system.actors
 * @param {Actor} droppedActor Actor dropped on to another actor
 * @param {Actor} targetActor Actor that is being dropped on to
 * @param {Object} entry The value to be written to the system.actors
 * @returns key that is set for the actor
 */
async function addActorIfUnique(droppedActor, targetActor, entry) {
  const actors = targetActor.system.actors;
  if (actors) {
    for (const [, actor] of Object.entries(actors)) {
      if (actor.uuid === droppedActor.uuid) {
        if (actor.type != "npc") {
          ui.notifications.error(game.i18n.localize('E20.ActorDuplicateDrop'));
          return;
        }
      }
    }
  }

  const pathPrefix = "system.actors";
  const key = createId(actors);

  await targetActor.update({
    [`${pathPrefix}.${key}`]: entry,
  });

  return key;
}

/**
 * Detachable and Core Body can't be on the same Zord (Across the Stars p.104).
 * @param {Actor} actor
 * @param {Item|Object} trait   The Megaform Trait being added
 * @returns {Boolean}
 */
export function clashingMegaformTrait(actor, trait) {
  const CLASH = { detachable: 'coreBody', coreBody: 'detachable' };
  const other = CLASH[trait?.system?.type];
  return !!other && !!actor?.items?.some?.(item => item.type == 'megaformTrait' && item.system?.type == other);
}

export const WARZORD_ID = "Compendium.essence20.across_the_stars.Item.jX5IHpydHimdjbGb";

/**
 * Warzord (Across the Stars p.105): a Warzord with Combiner "must now spend 1 Story Point per Zord combining with it".
 * The Story Points its Ranger owes when `joining` comes into a Megazord: a Warzord joining owes one per Zord already in
 * it; a Zord joining owes each Warzord already in it one. [{warzord, cost}] - exported for tests.
 * @param {Actor[]} present   The Megazord's current participants
 * @param {Actor} joining
 */
export function warzordCosts(present, joining) {
  const { sourceOf } = WARZORD_HELPERS;
  const isWarzord = actor => actor?.type == 'zord' && (actor.items?.contents ?? [...(actor.items ?? [])]).some(item => sourceOf(item) == WARZORD_ID);
  if (joining?.type != 'zord') {
    return [];
  }

  if (isWarzord(joining)) {
    const others = present.filter(actor => actor.type == 'zord').length;
    return others ? [{ warzord: joining, cost: others }] : [];
  }

  return present.filter(isWarzord).map(warzord => ({ warzord, cost: 1 }));
}

const WARZORD_HELPERS = { sourceOf: item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? null };

/** Spend the Warzord Story Points for a drop; false (with a warning) when its Ranger can't. */
async function payWarzordStoryPoints(megaform, joining) {
  if (megaform.system.subtype?.includes?.('megaformCombiner')) {
    return true;
  }

  const costs = warzordCosts(getMegaformParticipants(megaform), joining);
  if (!costs.length) {
    return true;
  }

  const { zordOwner } = await import("../rules/plugins/zords/zord-owner-spectrum.mjs");
  const sp = await import("../mechanics/resources/story-points.mjs");
  const payers = costs.map(({ warzord, cost }) => ({ warzord, cost, owner: zordOwner(warzord) ?? warzord }));
  for (const { warzord, cost, owner } of payers) {
    if (!sp.canSpendForActor(owner, cost)) {
      ui.notifications.warn(game.i18n.format('E20.WarzordNoStoryPoints', { owner: owner.name, cost, name: warzord.name }));
      return false;
    }
  }

  for (const { warzord, cost, owner } of payers) {
    await sp.spendForActor(owner, cost);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: warzord }),
      content: game.i18n.format('E20.WarzordStoryPoints', { name: warzord.name, owner: owner.name, cost }),
    });
  }

  return true;
}
