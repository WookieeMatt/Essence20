/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @returns {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function() {
  const version = game.system.version;
  ui.notifications.info(game.i18n.format("MIGRATION.begin", {version}), {permanent: true});

  // Migrate World Actors
  const actors = game.actors.map(a => [a, true])
    .concat(Array.from(game.actors.invalidDocumentIds).map(id => [game.actors.getInvalid(id), false]));
  for (const [actor, valid] of actors) {
    try {
      const source = valid ? actor.toObject() : game.data.actors.find(a => a._id === actor.id);
      const updateData = migrateActorData(source);
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

      if (item.type == "threatPower") {
        item.delete();
      }

      const updateData = migrateItemData(source);
      if (!foundry.utils.isEmpty(updateData)) {
        console.log(`Migrating Item document ${item.name}`);
        await item.update(updateData, {enforceTypes: false, diff: valid});
        await item.update({"system.-=perkType": null});
        await item.update({"system.-=originPerkIds": null});
        await item.update({"system.-=perkIds": null});
        await item.update({"system.-=hangUpIds": null});
        await item.update({"system.-=upgradeIds": null});
        await item.update({"system.-=weaponEffectIds": null});
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
    if (p.metadata.packageType !== "world" && p.metadata.packageType !== "system" ) continue;
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
 * @returns {object}                The updateData to apply
 */
export const migrateActorData = function(actor) {
  const updateData = {};

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

  // Migrate Owned Items
  if (!actor.items) {
    return updateData;
  }

  const items = actor.items.reduce(async (arr, i) => {
    // Migrate the Owned Item
    const itemData = i instanceof CONFIG.Item.documentClass ? i.toObject() : i;
    const fullActor = game.actors.get(actor._id);
    const itemToDelete = fullActor.items.get(i._id);

    if (itemToDelete.type == "threatPower") {
      await itemToDelete.delete();
    } else if (itemToDelete.type == "classFeature") {
      if (itemToDelete.name == "Personal Power") {
        updateData[`system.powers.personal.max`] = itemToDelete.system.uses.max;
        updateData[`system.powers.personal.value`] = itemToDelete.system.uses.value;
        await itemToDelete.delete();
      } else if (itemToDelete.name == "Energon") {
        updateData[`system.energon.normal.value`] = itemToDelete.system.uses.value;
        updateData[`system.energon.normal.max`] = itemToDelete.system.uses.max;
        await itemToDelete.delete();
      }
    }

    let itemUpdate = await migrateItemData(itemData, fullActor);

    // Update the Owned Item
    if (!foundry.utils.isEmpty(itemUpdate)) {
      itemUpdate._id = itemData._id;
      arr.push(foundry.utils.expandObject(itemUpdate));
    }

    return arr;
  }, []);

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
* Generate a random ID
* Generate random number and convert it to base 36 and remove the '0.' at the beginning
* As long as the string is not long enough, generate more random data into it
* Use substring in case we generated a string with a length higher than the requested length
* @param length    The length of the random ID to generate
* @return          Return a string containing random letters and numbers
*/
export function randomId(length) {
  const multiplier = Math.pow(10, length);
  return Math.floor((1 + Math.random()) * multiplier)
    .toString(16)
    .substring(1);
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
        let attachedItem = "";
        attachedItem = await fromUuid(`Item.${perkId}`);
        if (!attachedItem) {
          attachedItem = await searchCompendium(perkId);
        }

        attachedItem.setFlag('core', 'parentId', item.uuid);

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
          armorBonus: attachedItem.armorBonus,
          availability: attachedItem.availability,
          benefit: attachedItem.benefit,
          description: attachedItem.description,
          prerequisite: attachedItem.prerequisite,
          source: attachedItem.source,
          subtype: attachedItem.type,
          traits: attachedItem.traits,
        };

        let id = "";
        do {
          id = randomId(5);
        } while (item.system.items[id]);

        updateData[`${pathPrefix}.${id}`] = entry;
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
  } else if (item.type == "threatPower") {
    const itemData = item;
    itemData.type = "power";
    itemData.system.canActivate = true;
    itemData.system.usesPer = item.system.charges;
    itemData.system.type = "threat";
    itemData.system.usesInterval = "perScene";

    //This is an attempt to catch as many actions as possible by converting to camelCase.
    if (item.system.actionType) {
      const parsedActionType = item.system.actionType.split(" ").map((word, i) => {
        return (i == 0 ? word[0].toLowerCase() : word[0].toUpperCase()) + word.substring(1);
      }).join("");
      itemData.system.actionType = Object.keys(CONFIG.E20.actionTypes).includes(parsedActionType) ? parsedActionType : "free";
    } else {
      itemData.system.actionType = "free";
    }

    if (actor) {
      Item.implementation.create(itemData, {parent: actor, keepId: true});
    } else {
      Item.implementation.create(itemData, {keepId: true});
    }
  } else if (item.type == 'origin') {
    if (item.system.originPerkIds) {
      for (const perkId of item.system.originPerkIds) {
        let attachedItem = "";
        attachedItem = await fromUuid(`Item.${perkId}`);
        if (!attachedItem) {
          attachedItem = await searchCompendium(perkId);
        }

        const entry = {
          uuid: attachedItem.uuid,
          img: attachedItem.img,
          name: attachedItem.name,
          type: attachedItem.type,
        };

        let id = "";
        do {
          id = randomId(5);
        } while (item.system.items[id]);

        updateData[`${pathPrefix}.${id}`] = entry;
      }
    }

  } else if (item.type == 'influence') {
    if (item.system.perkIds) {
      for (const perkId of item.system.perkIds) {
        let attachedItem = "";
        attachedItem = await fromUuid(`Item.${perkId}`);
        if (!attachedItem) {
          attachedItem = await searchCompendium(perkId);
        }

        const entry = {
          uuid: attachedItem.uuid,
          img: attachedItem.img,
          name: attachedItem.name,
          type: attachedItem.type,
        };

        let id = "";
        do {
          id = randomId(5);
        } while (item.system.items[id]);

        updateData[`${pathPrefix}.${id}`] = entry;
      }
    }

    if (item.system.hangUpIds) {
      for (const perkId of item.system.hangUpIds) {
        let attachedItem = "";
        attachedItem = await fromUuid(`Item.${perkId}`);
        if (!attachedItem) {
          attachedItem = await searchCompendium(perkId);
        }

        const entry = {
          uuid: attachedItem.uuid,
          img: attachedItem.img,
          name: attachedItem.name,
          type: attachedItem.type,
        };

        let id = "";
        do {
          id = randomId(5);
        } while (item.system.items[id]);

        updateData[`${pathPrefix}.${id}`] = entry;
      }
    }
  } else if (item.type == 'weapon') {
    if (item.system.upgradeIds) {
      for (const perkId of item.system.upgradeIds) {
        let attachedItem = "";
        attachedItem = await fromUuid(`Item.${perkId}`);
        if (!attachedItem) {
          attachedItem = await searchCompendium(perkId);
        }

        attachedItem.setFlag('core', 'parentId', item.uuid);

        const entry = {
          uuid: attachedItem.uuid,
          img: attachedItem.img,
          name: attachedItem.name,
          type: attachedItem.type,
          availability: attachedItem.availability,
          benefit: attachedItem.benefit,
          description: attachedItem.description,
          prerequisite: attachedItem.prerequisite,
          source: attachedItem.source,
          subtype: attachedItem.type,
          traits: attachedItem.traits,
        };

        let id = "";
        do {
          id = randomId(5);
        } while (item.system.items[id]);

        updateData[`${pathPrefix}.${id}`] = entry;
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
        let attachedItem = "";
        attachedItem = await fromUuid(`Item.${perkId}`);
        if (!attachedItem) {
          attachedItem = await searchCompendium(perkId);
        }

        attachedItem.setFlag('core', 'parentId', item.uuid);

        const entry = {
          uuid: attachedItem.uuid,
          img: attachedItem.img,
          name: attachedItem.name,
          type: attachedItem.type,
          classification: attachedItem.classification,
          damageValue: attachedItem.damageValue,
          damageType: attachedItem.damageType,
          numHands: attachedItem.numHands,
          numTargets: attachedItem.numTargets,
          radius: attachedItem.radius,
          range: attachedItem.range,
          shiftDown: attachedItem.shiftDown,
          traits: attachedItem.traits,
        };

        let id = "";
        do {
          id = randomId(5);
        } while (item.system.items[id]);

        updateData[`${pathPrefix}.${id}`] = entry;
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
        updateData = migrateActorData(doc.toObject());
        break;
      case "Item":
        if (doc.type == "threatPower") {
          doc.delete();
        }

        updateData = await migrateItemData(doc.toObject());
        if (doc.type == "origin") {
          await doc.update({"system.-=originPerkIds": null});
        } else if (doc.type == "influence") {
          await doc.update({"system.-=perkIds": null});
          await doc.update({"system.-=hangUpIds": null});
          await doc.update({"system.-=upgradeIds": null});
          await doc.update({"system.-=weaponEffectIds": null});
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
