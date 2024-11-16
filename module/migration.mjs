import { createId } from "./helpers/utils.mjs";
/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @returns {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function() {
  const version = game.system.version;
  ui.notifications.info(game.i18n.format("MIGRATION.begin", {version}), {permanent: true});

  // Attempt to fix invalid Actors
  const invalidActorIds = Array.from(game.actors.invalidDocumentIds);
  let reloadNeeded = false;
  for (const invalidId of invalidActorIds) {
    const invalidActor = game.actors.getInvalid(invalidId);
    if (invalidActor.type == "megaformZord") {
      await invalidActor.update({
        "type": "megaform",
      });
      reloadNeeded = true;
    }
  }

  if (reloadNeeded) {
    foundry.utils.debouncedReload();
    return;
  }

  // Migrate World Actors
  const actors = game.actors.map(a => [a, true])
    .concat(Array.from(game.actors.invalidDocumentIds).map(id => [game.actors.getInvalid(id), false]));
  for (const [actor, valid] of actors) {
    try {
      const source = valid ? actor.toObject() : game.data.actors.find(a => a._id === actor.id);
      const updateData = await migrateActorData(source);
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`Migrating Actor document ${actor.name}`);
        await actor.update(updateData, {enforceTypes: false, diff: valid});
        await actor.update({"system.skills.-=strength": null});
        await actor.update({"system.skills.-=smarts": null});
        await actor.update({"system.skills.-=social": null});
        await actor.update({"system.skills.-=speed": null});
        await actor.update({"system.skills.-=any": null});
      }
    } catch(err) {
      err.message = `Failed essence20 system migration for Actor ${actor.name}: ${err.message}`;
      console.error(err);
    }
  }

  // Migrate World Items
  const items = game.items.map(i => [i, true])
    .concat(Array.from(game.items.invalidDocumentIds).map(id => [game.items.getInvalid(id), false]));
  for (const [item, valid] of items) {
    try {
      const source = valid ? item.toObject() : game.data.items.find(i => i._id === item.id);

      if (["giJoe", "pony", "powerRanger", "transformer"].includes(item.type)) {
        item.delete();
        continue;
      }

      const updateData = await migrateItemData(source);
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`Migrating Item document ${item.name}`);
        await item.update(updateData, {enforceTypes: false, diff: valid});
        if (item.type == "origin") {
          await item.update({"system.-=originPerkIds": null});
        } else if (item.type == "influence") {
          await item.update({"system.-=perkIds": null});
          await item.update({"system.-=hangUpIds": null});
        } else if (item.type == "weapon") {
          await item.update({"system.-=upgradeIds": null});
          await item.update({"system.-=weaponEffectIds": null});
        } else if (item.type =="armor") {
          await item.update({"system.-=upgradeIds": null});
        }
      }
    } catch(err) {
      err.message = `Failed essence20 system migration for Item ${item.name}: ${err.message}`;
      console.error(err);
    }
  }

  /* Leaving this here in case we need to migrate Macros later
  // Migrate World Macros
  for ( const m of game.macros ) {
    try {
      const updateData = migrateMacroData(m.toObject(), migrationData);
      if ( !foundry.utils.isEmpty(updateData) ) {
        console.log(`Migrating Macro document ${m.name}`);
        await m.update(updateData, {enforceTypes: false});
      }
    } catch(err) {
      err.message = `Failed dnd5e system migration for Macro ${m.name}: ${err.message}`;
      console.error(err);
    }
  }
  */

  /* Leaving this here in case we need to migrate Actor Override Tokens later
  // Migrate Actor Override Tokens
  for ( let s of game.scenes ) {
    try {
      const updateData = migrateSceneData(s, migrationData);
      if ( !foundry.utils.isEmpty(updateData) ) {
        console.log(`Migrating Scene document ${s.name}`);
        await s.update(updateData, {enforceTypes: false});
        // If we do not do this, then synthetic token actors remain in cache
        // with the un-updated actorData.
        s.tokens.forEach(t => t._actor = null);
      }
    } catch(err) {
      err.message = `Failed dnd5e system migration for Scene ${s.name}: ${err.message}`;
      console.error(err);
    }
  }
  */

  // Migrate World Compendium Packs
  for (let p of game.packs) {
    if (p.metadata.system != "essence20") continue;
    if (!["world", "module"].includes(p.metadata.packageType)) continue;
    if (!["Actor", "Item", "Scene"].includes(p.documentName)) continue;
    await migrateCompendium(p);
  }

  // Set the migration as complete
  game.settings.set("essence20", "systemMigrationVersion", game.system.version);
  ui.notifications.info(game.i18n.format("MIGRATION.complete", {version}), {permanent: true});
};

/* -------------------------------------------- */
/*  Document Type Migration Helpers             */
/* -------------------------------------------- */

/**
 * Migrate a single Actor document to incorporate latest data model changes
 * Return an Object of updateData to be applied
 * @param {object} actor            The actor data object to update
 * @param {object} compendiumActor The full actor from the compendium
 * @returns {object}                The updateData to apply
 */
export const migrateActorData = async function(actor, compendiumActor) {
  const updateData = {};

  //Migration for Weapon and Armor Training and Qualificaitons moving to Actors from Roles
  const currentVersion = game.settings.get("essence20", "systemMigrationVersion");
  if (!currentVersion || foundry.utils.isNewerVersion('4.5.1', currentVersion)) {
    if (actor.items) {
      for (const item of actor.items) {
        if (item.type == 'role') {
          for (const armorType of item.system.armors.qualified) {
            if (armorType) {
              updateData[`system.qualified.armors.${armorType}`] = true;
            }
          }

          for (const armorType of item.system.armors.trained) {
            if (armorType) {
              updateData[`system.trained.armors.${armorType}`] = true;
            }
          }

          for (const armorType of item.system.upgrades.armors.trained) {
            if (armorType) {
              updateData[`system.trained.upgrades.armors.${armorType}`] = true;
            }
          }

          for (const weaponType of item.system.weapons.qualified) {
            if (weaponType) {
              updateData[`system.qualified.weapons.${weaponType}`] = true;
            }
          }

          for (const weaponType of item.system.weapons.trained) {
            if (weaponType) {
              updateData[`system.trained.weapons.${weaponType}`] = true;
            }
          }

          if (item.system.version =='giJoe') {
            updateData[`system.canQualify`] = true;
          }
        }
      }
    }
  }

  // Migrate initiative
  if (typeof actor.system.initiative == "string") {
    updateData[`system.initiative`] = {
      "formula": "", // This will populate after the actor's first initiative roll
      "modifier": 0,
      "shift": actor.system.initiative,
    };
  }

  // Migrate Skills
  if (actor.system.skills.strength) {
    const skillsForEssences = actor.system.skills;
    const essenceList = ["any", "strength", "speed", "smarts", "social"];
    let newSkills = {};
    for (const [essence, skillsForEssence] of Object.entries(skillsForEssences)) {
      if (essenceList.includes(essence)) {
        for (const [skill, fields] of Object.entries(skillsForEssence)) {
          newSkills[skill] = {
            "isSpecialized": fields.isSpecialized,
            "modifier": fields.modifier,
            "shift": fields.shift,
            "shiftDown": fields.shiftDown,
            "shiftUp": fields.shiftUp,
          };
        }
      }
    }

    updateData[`system.skills`] = newSkills;
  }

  if (!actor.system.skills.acrobatics.essences.speed) {
    for (const skill of Object.keys(actor.system.skills)) {
      if (skill != 'roleSkillDie') {
        const essence = CONFIG.E20.skillToEssence[skill];
        if (essence == 'any') {
          updateData[`system.skills.${skill}.essences.smarts`] = true;
          updateData[`system.skills.${skill}.essences.social`] = true;
          updateData[`system.skills.${skill}.essences.speed`] = true;
          updateData[`system.skills.${skill}.essences.strength`] = true;
        } else {
          updateData[`system.skills.${skill}.essences.${essence}`] = true;
        }
      }
    }
  }


  // Migrate to Base Movement
  if (Object.keys(actor.system.movement.aerial).sort() != ['altMode', 'base', 'bonus', 'morphed', 'total']) {
    updateData[`system.movement.aerial.altMode`] = 0;
    updateData[`system.movement.aerial.base`] = 0;
    updateData[`system.movement.aerial.bonus`] = 0;
    updateData[`system.movement.aerial.morphed`] = 0;
    updateData[`system.movement.aerial.total`] = 0;

    updateData[`system.movement.ground.altMode`] = 0;
    updateData[`system.movement.ground.base`] = 0;
    updateData[`system.movement.ground.bonus`] = 0;
    updateData[`system.movement.ground.morphed`] = 0;
    updateData[`system.movement.ground.total`] = 0;

    updateData[`system.movement.swim.altMode`] = 0;
    updateData[`system.movement.swim.base`] = 0;
    updateData[`system.movement.swim.bonus`] = 0;
    updateData[`system.movement.swim.morphed`] = 0;
    updateData[`system.movement.swim.total`] = 0;

    if (["giJoe", "pony", "powerRanger", "transformer"].includes(actor.type)) {
      for (const item of actor.items) {
        if (item.type == 'origin') {
          updateData[`system.movement.aerial.base`] = item.system.baseAerialMovement;
          updateData[`system.movement.ground.base`] = item.system.baseGroundMovement;
          updateData[`system.movement.swim.base`] = item.system.baseAquaticMovement;
          break;
        }
      }
    } else if (typeof actor.system.movement.aerial == 'string') { // Non-PCs
      updateData[`system.movement.aerial.total`] = actor.system.movement.aerial;
      updateData[`system.movement.ground.total`] = actor.system.movement.ground;
      updateData[`system.movement.swim.total`] = actor.system.movement.swim;
    } else { // Non-PCs where movement fields are already objects
      updateData[`system.movement.aerial.total`] = actor.system.movement.aerial.total;
      updateData[`system.movement.ground.total`] = actor.system.movement.ground.total;
      updateData[`system.movement.swim.total`] = actor.system.movement.swim.total;
    }
  }

  // Migrate Zord/MFZ essence
  if (["zord", "megaformZord"].includes(actor.type)) {
    const strength = actor.system.essences.strength;
    if (typeof strength == 'number') {
      updateData[`system.essences.strength`] = {
        usesDrivers: false,
        value: actor.system.essences.strength,
      };
    }

    const speed = actor.system.essences.speed;
    if (typeof speed == 'number') {
      updateData[`system.essences.speed`] = {
        usesDrivers: false,
        value: actor.system.essences.speed,
      };
    }
  }

  // Migrate zordIds to Actor entries
  if (actor.type == "megaform" && actor.system.zordIds.length) {
    const pathPrefix = "system.actors";
    for (const zordId of actor.system.zordIds) {
      const droppedActor = game.actors.get(zordId);
      const entry = {
        uuid: droppedActor.uuid,
        img: droppedActor.img,
        name: droppedActor.name,
        type: droppedActor.type,
      };
      const id = await createId(actor.system.actors);
      updateData[`${pathPrefix}.${id}`] = entry;
    }
  }

  // Migrate Owned Items
  if (!actor.items) {
    return updateData;
  }

  const items = [];
  for (const itemData of actor.items) {
    // Migrate the Owned Item
    const fullActor = game.actors.get(actor._id) || compendiumActor;

    const itemToDelete = fullActor.items.get(itemData._id);

    if (itemToDelete.type == "classFeature") {
      if (itemToDelete.name == "Personal Power") {
        updateData[`system.powers.personal.max`] = itemToDelete.system.uses.max;
        updateData[`system.powers.personal.value`] = itemToDelete.system.uses.value;
        await itemToDelete.delete();
      } else if (itemToDelete.name == "Energon") {
        updateData[`system.energon.normal.value`] = itemToDelete.system.uses.value;
        updateData[`system.energon.normal.max`] = itemToDelete.system.uses.max;
        await itemToDelete.delete();
      } else {
        await itemToDelete.delete();
      }
    }

    let itemUpdate = await migrateItemData(itemToDelete, fullActor);

    if (itemToDelete.type == "origin") {
      await itemToDelete.update({"system.-=originPerkIds": null});
    } else if (itemToDelete.type == "influence") {
      await itemToDelete.update({"system.-=perkIds": null});
      await itemToDelete.update({"system.-=hangUpIds": null});
    } else if (itemToDelete.type == "weapon") {
      await itemToDelete.update({"system.-=upgradeIds": null});
      await itemToDelete.update({"system.-=weaponEffectIds": null});
    } else if (itemToDelete.type =="armor") {
      await itemToDelete.update({"system.-=upgradeIds": null});
    }

    // Update the Owned Item
    if (!foundry.utils.isEmpty(itemUpdate)) {
      itemUpdate._id = itemData._id;
      items.push(itemUpdate);
    }

  }

  if (items.length > 0) {
    updateData.items = items;
  }

  return updateData;
};

/**
* Handles search of the Compendiums to find the item
* @param {Item|String} item  Either an ID or an Item to find in the compendium
* @returns {Item}     The Item, if found
*/
export async function searchCompendium(item) {
  const id = item._id || item;
  for (const pack of game.packs) {
    const compendium = game.packs.get(`essence20.${pack.metadata.name}`);
    if (compendium) {
      const compendiumItem = await fromUuid(`Compendium.essence20.${pack.metadata.name}.${id}`);
      if (compendiumItem) {
        return compendiumItem;
      }
    }
  }
}

/**
* Gets an Item from an Id
* @param {Item|String} perkId The id from the parentItem
* @param {object} actor The actor that has the items that are getting updated.
* @returns {Item} attachedItem  The Item, if found
*/
export async function getItem(perkId, actor) {
  let attachedItem = await fromUuid(`Item.${perkId}`);
  if (!attachedItem) {
    attachedItem = await searchCompendium(perkId);
  }

  if (!attachedItem && actor) {
    attachedItem = await actor.items.get(perkId);
  }

  return attachedItem;
}

/**
* Migrate a single Item document to incorporate latest data model changes
*
* @param {object} item             Item data to migrate
* @returns {object}                The updateData to apply
*/
export async function migrateItemData(item, actor) {
  const updateData = {};
  const pathPrefix = "system.items";

  if (item.type == "armor") {
    // Armor trait -> traits migration
    const trait = item.system.trait;
    if (trait && !item.system.traits[trait]) {
      updateData[`system.traits`] = [trait];
    }

    // Armor traits string->bool object -> string list migration
    const traits = item.system.traits;
    if (traits && traits.constructor == Object) {
      const traitsArray = [];
      for (let [trait, traitIsEnabled] of Object.entries(traits)) {
        if (traitIsEnabled) {
          traitsArray.push(trait);
        }
      }

      updateData[`system.traits`] = traitsArray;
    }

    // Armor effect -> bonusToughness migration
    const effect = item.system.effect;
    if (effect && !item.system.bonusToughness) {
      updateData[`system.bonusToughness`] = effect;
    }

    //Armor Upgrade Migration to system.items
    if (item.system.upgradeIds) {
      for (const perkId of item.system.upgradeIds) {
        const attachedItem = await getItem(perkId, actor);
        if (attachedItem) {
          attachedItem.setFlag('essence20', 'parentId', item.uuid);

          if (attachedItem.armorBonus) {
            if (attachedItem.armorBonus.defense == 'toughness') {
              const originalArmorBonus = item.system.bonusToughness - attachedItem.armorBonus.value;
              updateData[`system.bonusToughness`] = originalArmorBonus;
            } else if (attachedItem.armorBonus.defense == 'evasion') {
              const originalArmorBonus = item.system.bonusEvasion - attachedItem.armorBonus.value;
              updateData[`system.bonusEvasion`] = originalArmorBonus;
            }
          }

          const entry = {
            uuid: attachedItem.uuid,
            img: attachedItem.img,
            name: attachedItem.name,
            type: attachedItem.type,
            armorBonus: attachedItem.system.armorBonus,
            availability: attachedItem.system.availability,
            benefit: attachedItem.system.benefit,
            description: attachedItem.system.description,
            prerequisite: attachedItem.system.prerequisite,
            source: attachedItem.system.source,
            subtype: attachedItem.system.type,
            traits: attachedItem.system.traits,
          };
          const id = await createId(item.system.items);
          updateData[`${pathPrefix}.${id}`] = entry;
        }
      }

      if (item.system.upgradeTraits) {
        let keptTraits = item.system.traits;
        for (const removedTrait of item.system.upgradeTraits) {
          keptTraits.filter(x => x !== removedTrait);
        }

        updateData[`system.traits`] = keptTraits;
      }
    }
  } else if (item.type == "perk") {
    if (item.system.perkType) {
      const perkType = item.system.perkType;
      updateData[`system.type`] = perkType;
    }
  } else if (item.type == 'origin') {
    if (item.system.originPerkIds) {
      for (const perkId of item.system.originPerkIds) {
        const attachedItem = await getItem(perkId, actor);
        if (attachedItem) {
          const entry = {
            uuid: attachedItem.uuid,
            img: attachedItem.img,
            name: attachedItem.name,
            type: attachedItem.type,
          };
          const id = await createId(item.system.items);
          updateData[`${pathPrefix}.${id}`] = entry;
        }
      }
    }

  } else if (item.type == 'influence') {
    if (item.system.perkIds) {
      for (const perkId of item.system.perkIds) {
        const attachedItem = await getItem(perkId, actor);
        if (attachedItem) {
          const entry = {
            uuid: attachedItem.uuid,
            img: attachedItem.img,
            name: attachedItem.name,
            type: attachedItem.type,
          };
          const id = await createId(item.system.items);
          updateData[`${pathPrefix}.${id}`] = entry;
        }
      }
    }

    if (item.system.hangUpIds) {
      for (const perkId of item.system.hangUpIds) {
        const attachedItem = await getItem(perkId, actor);
        if (attachedItem) {
          const entry = {
            uuid: attachedItem.uuid,
            img: attachedItem.img,
            name: attachedItem.name,
            type: attachedItem.type,
          };
          const id = await createId(item.system.items);
          updateData[`${pathPrefix}.${id}`] = entry;
        }
      }
    }
  } else if (item.type == 'weapon') {
    if (item.system.upgradeIds) {
      for (const perkId of item.system.upgradeIds) {
        const attachedItem = await getItem(perkId, actor);
        if (attachedItem) {
          attachedItem.setFlag('essence20', 'parentId', item.uuid);

          const entry = {
            uuid: attachedItem.uuid,
            img: attachedItem.img,
            name: attachedItem.name,
            type: attachedItem.type,
            availability: attachedItem.system.availability,
            benefit: attachedItem.system.benefit,
            description: attachedItem.system.description,
            prerequisite: attachedItem.system.prerequisite,
            source: attachedItem.system.source,
            subtype: attachedItem.system.type,
            traits: attachedItem.system.traits,
          };
          const id = await createId(item.system.items);
          updateData[`${pathPrefix}.${id}`] = entry;
        }
      }

      if (item.system.upgradeTraits) {
        let keptTraits = item.system.traits;
        for (const removedTrait of item.system.upgradeTraits) {
          keptTraits.filter(x => x !== removedTrait);
        }

        updateData[`system.traits`] = keptTraits;
      }
    }

    if (item.system.weaponEffectIds) {
      for (const perkId of item.system.weaponEffectIds) {
        const attachedItem = await getItem(perkId, actor);
        if (attachedItem) {
          attachedItem.setFlag('essence20', 'parentId', item.uuid);

          const entry = {
            uuid: attachedItem.uuid,
            img: attachedItem.img,
            name: attachedItem.name,
            type: attachedItem.type,
            classification: attachedItem.system.classification,
            damageValue: attachedItem.system.damageValue,
            damageType: attachedItem.system.damageType,
            numHands: attachedItem.system.numHands,
            numTargets: attachedItem.system.numTargets,
            radius: attachedItem.system.radius,
            range: attachedItem.system.range,
            shiftDown: attachedItem.system.shiftDown,
            traits: attachedItem.system.traits,
          };
          const id = await createId(item.system.items);
          updateData[`${pathPrefix}.${id}`] = entry;
        }
      }
    }
  }

  return updateData;
}

/**
 * Apply migration rules to all Documents within a single Compendium pack
 * @param {CompendiumCollection} pack  Pack to be migrated.
 * @returns {Promise}
 */
export const migrateCompendium = async function(pack) {
  const documentName = pack.documentName;
  if ( !["Actor", "Item", "Scene"].includes(documentName) ) return;

  // Unlock the pack for editing
  const wasLocked = pack.locked;
  await pack.configure({locked: false});

  // Begin by requesting server-side data model migration and get the migrated content
  await pack.migrate();
  const documents = await pack.getDocuments();

  // Iterate over compendium entries - applying fine-tuned migration functions
  for ( let doc of documents ) {
    let updateData = {};
    try {
      switch (documentName) {
      case "Actor":
        updateData = await migrateActorData(doc.toObject(), doc);
        break;
      case "Item":
        updateData = await migrateItemData(doc.toObject());
        if (doc.type == "origin") {
          await doc.update({"system.-=originPerkIds": null});
        } else if (doc.type == "influence") {
          await doc.update({"system.-=perkIds": null});
          await doc.update({"system.-=hangUpIds": null});
        } else if (doc.type == "weapon") {
          await doc.update({"system.-=upgradeIds": null});
          await doc.update({"system.-=weaponEffectIds": null});
        } else if (doc.type =="armor") {
          await doc.update({"system.-=upgradeIds": null});
        }

        break;
      case "Scene":
        // updateData = migrateSceneData(doc.toObject());
        break;
      }

      // Save the entry, if data was changed
      if ( foundry.utils.isEmpty(updateData) ) continue;
      await doc.update(updateData);
      console.log(`Migrated ${documentName} document ${doc.name} in Compendium ${pack.collection}`);
    } catch(err) { // Handle migration failures
      err.message = `Failed essence20 system migration for document ${doc.name} in pack ${pack.collection}: ${err.message}`;
      console.error(err);
    }
  }

  // Apply the original locked status for the pack
  await pack.configure({locked: wasLocked});
  console.log(`Migrated all ${documentName} documents from Compendium ${pack.collection}`);
};
